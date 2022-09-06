declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_WEBHOOK: string;
    }
  }
}

export { }