const validPracticeQaRun = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
module.exports = { validPracticeQaRun };
if (require.main === module && !validPracticeQaRun(process.env.EXPO_PUBLIC_PRACTICE_QA_RUN)) {
  console.error('Set a new EXPO_PUBLIC_PRACTICE_QA_RUN (8–80 characters). Expo was not started; existing data was not opened.');
  process.exitCode = 1;
}
