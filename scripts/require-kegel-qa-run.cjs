const validKegelQaRun = value => typeof value === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
module.exports = { validKegelQaRun };
if (require.main === module && !validKegelQaRun(process.env.EXPO_PUBLIC_KEGEL_QA_RUN)) {
  console.error("Set EXPO_PUBLIC_KEGEL_QA_RUN to a new 8–80 character name before starting isolated persistence QA. Expo was not started; existing E2E data was not opened.");
  process.exitCode = 1;
}
