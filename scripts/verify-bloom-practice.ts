import { createPracticeSession, formatPracticeTime } from "../src/features/practice/practiceSession";
function check(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
let clock=0;const s=createPracticeSession(()=>clock);
s.start();s.start();clock=1250;s.tick();check(s.getSnapshot().elapsedMs===1250,"real monotonic elapsed; duplicate start ignored");
s.reportLevel(7);s.reportLevel(99);check(s.getSnapshot().levels.length===1,"only explicit valid arousal reports");
s.pause();s.pause();clock=3250;s.tick();s.resume();s.resume();check(s.getSnapshot().pauses.length===1&&s.getSnapshot().pauses[0]?.durationMs===2000,"duplicate pause/resume does not duplicate intervals");
clock=4250;s.background();const elapsed=s.getSnapshot().elapsedMs;clock=104250;s.tick();s.pause();s.finish();check(s.getSnapshot().elapsedMs===elapsed&&s.getSnapshot().phase==="running","background excluded and controls guarded");
s.continueForeground();clock+=1000;s.askExit();clock+=20000;s.tick();check(s.getSnapshot().elapsedMs===elapsed+1000,"exit confirmation excludes time");s.keep();s.pause();clock+=3000;s.finish();check(s.getSnapshot().pauses.length===2&&s.getSnapshot().pauseMs===0,"finishing during pause closes it once");
const frozen=s.getSnapshot().elapsedMs;clock+=90000;s.tick();check(s.getSnapshot().elapsedMs===frozen,"reflection clock frozen");
s.next(0);check(s.getSnapshot().question===0,"requires answer or explicit skip");s.answerQuality(8);s.next(0);s.next(0);check(s.getSnapshot().question===1,"stale next cannot skip question");s.answerContent(true);s.next(1);s.answerEnding("stopped");s.toggleFeeling("Sakin");s.toggleFeeling("Kontrollü");s.next(2);check(s.getSnapshot().phase==="summary"&&s.getSnapshot().content===true&&s.getSnapshot().feelings.length===2,"three reflections generate actual summary");
s.edit();s.next(0,true);s.next(1,true);s.next(2,true);check(s.getSnapshot().quality===null&&s.getSnapshot().ending===null,"all questions skippable; edit keeps timings");
s.askExit();s.background();s.keep();s.discard();check(s.getSnapshot().phase==="discarded","exit discards temporary session");const fresh=createPracticeSession(()=>clock);check(fresh.getSnapshot().phase==="intro"&&fresh.getSnapshot().elapsedMs===0&&fresh.getSnapshot().levels.length===0,"restart has no historical sessions or draft");
let notified=0;s.subscribe(()=>notified++);s.dispose();clock+=1000;s.start();s.tick();check(notified===0,"dispose clears listeners and timer anchor");
fresh.start();clock+=1000;fresh.tick();fresh.dispose();clock+=1000;fresh.activate();clock+=1000;fresh.tick();check(fresh.getSnapshot().elapsedMs===2000,"Strict Mode effect remount does not count cleanup gap");
check(formatPracticeTime(61001)==="01:01","elapsed formatting");
console.log("Practice runtime: elapsed, pause, resume, background, exit, reflections, skips, edit, restart, cleanup passed.");
