export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "meowsenger",
  description: "meowsenger - beautiful messenger",
};

export const ROUTES = {
  home: "/",
  // auth
  login: "/login",
  signup: "/signup",
  // chatting
  chats: "/chats",
  chat: (id: string) => `/chats/${id}`,
  // users
  user: (id: string) => `/user/${id}`,
  settings: "/settings",
};
