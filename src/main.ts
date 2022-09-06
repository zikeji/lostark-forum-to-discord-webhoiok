import fetch from "node-fetch";
import { scheduleJob } from "node-schedule";
import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone.js";
import TurndownService from "turndown";

dayjs.extend(tz);

interface DiscourseUser {
  id: number;
  username: string;
  avatar_template: string;
  primary_group_name: string;
  flair_name: string;
  admin: boolean;
  trust_level: number;
}

interface DiscourseGroup {
  id: number;
  name: string;
}

interface DiscourseFlairGroup {
  id: number;
  name: string;
  flair_url: string | null;
  flair_bg_color: string;
  flair_color: string;
}

interface DiscourseTopic {
  id: number;
  title: string;
  fancy_title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  highest_post_number: number;
  image_url: string | null;
  created_at: string;
  last_posted_at: string;
  bumped: boolean;
  bumped_at: string;
  archetype: string;
  unseen: boolean;
  pinned: boolean;
  unpinned: null;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  bookmarked: null;
  liked: null;
  tags_descriptions: unknown;
  views: number;
  like_count: number;
  has_summary: boolean;
  last_poster_username: string;
  category_id: number;
  pinned_globally: boolean;
  first_tracked_post: {
    group: string;
    post_number: number;
  };
  has_accepted_answer: boolean;
  posters: {
    extras: string;
    description: string;
    user_id: number;
    primary_group_id: number;
    flair_group_id: number;
  }[];
}

interface DiscourseTopicsResponse {
  users: DiscourseUser[];
  primary_groups: DiscourseGroup[];
  flair_groups: DiscourseFlairGroup[];
  topic_list: {
    can_create_topic: boolean;
    more_topics_url: string;
    per_page: number;
    topics: DiscourseTopic[];
  };
}

interface DiscoursePost {
  id: number;
  username: string;
  avatar_template: string;
  created_at: string;
  cooked: string;
  post_number: number;
  post_type: number;
  updated_at: string;
  reply_count: number;
  reply_to_post_number: null | number;
  quote_count: number;
  incoming_link_count: number;
  reads: number;
  readers_count: number;
  score: number;
  yours: boolean;
  topic_id: number;
  topic_slug: string;
  primary_group_name: string;
  flair_name: string;
  flair_url: null | string;
  flair_bg_color: string;
  flair_color: string;
  version: number;
  can_edit: boolean;
  can_delete: boolean;
  can_recover: boolean;
  can_wiki: boolean;
  link_counts: {
    url: string;
    internal: boolean;
    reflection: boolean;
    clicks: number;
  }[];
  read: boolean;
  user_title: string;
  title_is_group: boolean;
  bookmarked: false;
  aciton_summary: never[];
  moderator: boolean;
  admin: boolean;
  staff: boolean;
  user_id: number;
  hidden: boolean;
  trust_level: number;
  deleted_at: null | string;
  user_deleted: boolean;
  edit_reason: null | string;
  can_view_edit_history: boolean;
  wiki: boolean;
  can_accept_answer: false;
  can_unaccept_answer: false;
  accepted_answer: false;
}

interface DiscourseTopicResponse {
  post_stream: {
    posts: DiscoursePost[];
    stream: number[];
  };
  timeline_lookup: never[];
  suggeested_topics: never[];
  tags_descriptions: unknown;
  id: number;
  title: string;
  fance_title: string;
  posts_count: number;
  created_at: string;
  views: number;
  reply_count: number;
  like_count: number;
  last_posted_at: string;
  visible: boolean;
  closed: boolean;
  archived: boolean;
  has_summary: boolean;
  archetype: string;
  slug: string;
  category: number;
  word_count: number;
  deleted_at: null | string;
  user_id: number;
  featued_link: null | string;
  pinned_globally: boolean;
  pinned_at: null | string;
  pinned_until: null | string;
  image_url: string | null;
  slow_mode_seconds: number;
  draft: null | unknown;
  draft_key: string;
  draft_sequence: null | unknown;
  unpinned: null | unknown;
  pinned: boolean;
  currnet_post_number: number;
  highest_post_number: number;
  deleted_by: null | unknown;
  actions_summary: never[];
  chunk_size: number;
  bookmarked: false;
  bookmarks: never;
  topic_timer: null | unknown;
  message_bus_last_id: number;
  participant_count: number;
  show_read_indicator: false;
  thumbnails: null;
  slow_mode_enabled_until: string | null;
  first_tracked_post: never;
  tracked_posts: never[];
  details: {
    can_edit: boolean;
    notificaiton_level: number;
    participants: DiscourseUser[];
    created_by: {
      id: number;
      username: string;
      avatar_template: string;
    }
    last_poster: {
      id: number;
      username: string;
      avatar_template: string;
    }
    links: never[];
  }
}

const turndownService = new TurndownService();
turndownService.addRule("aside", {
  filter: ["aside"],
  replacement: (_, node) => {
    if ("classList" in node && node.classList.contains("onebox")) {
      const a = node.querySelector("article.onebox-body > h3 > a");
      if (a && "getAttribute" in a) {
        return `[${a.textContent}](${a.getAttribute("href")})`;
      }
    }
    return "";
  }
});

const seenCache: Map<number, dayjs.Dayjs> = new Map();
const cleanCache = () => {
  seenCache.forEach((value, key) => {
    if (dayjs().diff(value, "minute") > 15) {
      seenCache.delete(key);
    }
  })
}

const main = async () => {
  cleanCache();
  const result = await fetch("https://forums.playlostark.com/c/official-news/official-news/53.json");
  const data = await result.json() as DiscourseTopicsResponse;
  for (const topic of data.topic_list.topics) {
    if (seenCache.has(topic.id) || dayjs().diff(dayjs(topic.created_at), "minute") > 15) continue;
    seenCache.set(topic.id, dayjs(topic.created_at));
    const details = await (await fetch(`https://forums.playlostark.com/t/${topic.id}.json`)).json() as DiscourseTopicResponse;
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: details.details.created_by.username,
        avatar_url: `https://forums.playlostark.com/${details.details.created_by.avatar_template.replace("{size}", "128")}`,
        embeds: [
          {
            title: details.title,
            description: turndownService.turndown(details.post_stream.posts[0]?.cooked ?? "n/a"),
            url: `https://forums.playlostark.com/t/${details.slug}/${details.id}`,
            color: 13082403,
            timestamp: dayjs(details.created_at).toISOString()
          }
        ]
      })
    });
  }
}

scheduleJob("* * * * *", main);