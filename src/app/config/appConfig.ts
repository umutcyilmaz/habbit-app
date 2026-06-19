import appConfigJson from "./appConfig.json";

export type AppConfig = {
  APP_NAME: string;
  APP_WORKING_TITLE: string;
  APP_TAGLINE: string;
  PRODUCT_NAME_STATUS: string;
  SUPPORT_EMAIL: string;
  IS_BRAND_NAME_FINAL: boolean;
};

export const appConfig: AppConfig = appConfigJson;
