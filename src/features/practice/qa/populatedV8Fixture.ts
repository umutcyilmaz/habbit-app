// Synthetic migration fixture. Only the guarded, new E2E namespace seeds this data.
export default {
  "practice": {
    "introduction": null,
    "sessions": []
  },
  "library": {
    "bookmarkedArticleIds": [
      "wave"
    ],
    "completedArticleIds": [
      "wave"
    ]
  },
  "kegel": {
    "onboardingCompletedAt": null,
    "sessions": []
  },
  "activePlan": {
    "primaryPattern": "pornLoop",
    "secondaryPattern": "pressurePattern",
    "planName": "Legacy plan",
    "resultTitle": "Legacy result",
    "recommendedFirstAction": "setupProtection"
  },
  "onboarding": {
    "completed": true,
    "quizAnswers": {
      "porn_first": 2,
      "loop_triggers": [
        "boredom"
      ]
    },
    "quizResult": {
      "scores": {
        "PL": 5,
        "PP": 3,
        "CT": 1,
        "FC": 1
      },
      "normalizedScores": {
        "PL": 0.8,
        "PP": 0.5,
        "CT": 0.1,
        "FC": 0.2
      },
      "primaryPattern": "pornLoop",
      "secondaryPattern": "pressurePattern",
      "flags": {
        "eveningWindow": true,
        "emptyMoments": true,
        "boredom": true,
        "aloneTime": true,
        "stressTrigger": true,
        "phoneLoop": true,
        "firmnessConcern": false
      },
      "resultTitle": "Legacy result",
      "resultBody": "Keep this legacy observation.",
      "planName": "Legacy plan",
      "recommendedFirstAction": "setupProtection",
      "firstPlanSteps": [
        {
          "title": "Keep",
          "description": "Existing step"
        }
      ],
      "chips": [
        "Existing chip"
      ],
      "completedAt": "2026-07-22T10:00:00.000Z"
    },
    "completedAt": "2026-07-22T10:00:00.000Z"
  },
  "tenDayReset": {
    "startedAt": "2026-07-01",
    "completedDates": [
      "2026-07-01",
      "2026-07-02"
    ],
    "lastCompletedAt": "2026-07-02T10:00:00.000Z"
  },
  "debug": {
    "dateOffsetDays": 7
  },
  "protection": {
    "status": "active",
    "setupCompletedAt": "2026-07-01T00:00:00.000Z",
    "preferredWindow": "night",
    "level": "balanced",
    "adultContentPauseEnabled": true,
    "nightStartTime": "22:00",
    "nightEndTime": "08:00",
    "lastProtectionPauseAt": "2026-07-02T22:00:00.000Z"
  },
  "checkIns": {
    "records": [
      {
        "id": "legacy-check-in",
        "createdAt": "2026-07-02T22:00:00.000Z",
        "mood": "calm",
        "moment": "evening",
        "eventType": "both",
        "note": "Retain this private reflection."
      }
    ]
  },
  "pause": {
    "activeSession": {
      "id": "legacy-pause-active",
      "startedAt": "2026-07-03T22:00:00.000Z",
      "phase": "timer",
      "triggers": [
        "boredom"
      ],
      "intensityBefore": 8,
      "selectedAction": "pause90",
      "timerStartedAt": "2026-07-03T22:00:00.000Z",
      "timerDurationSeconds": 90,
      "elapsedDurationSeconds": 30
    },
    "records": [
      {
        "id": "legacy-pause-record",
        "startedAt": "2026-07-02T22:00:00.000Z",
        "completedAt": "2026-07-02T22:02:00.000Z",
        "triggers": [
          "stress"
        ],
        "intensityBefore": 6,
        "intensityAfterChange": "lower",
        "selectedAction": "pause90",
        "feltTruth": "calmer",
        "nextStep": "savePause",
        "durationSeconds": 90
      }
    ]
  },
  "arousalControl": {
    "draft": {
      "id": "legacy-arousal-draft",
      "startedAt": "2026-07-03T12:00:00.000Z",
      "dateKey": "2026-07-03",
      "mode": "onePause",
      "adultContent": "yes",
      "pauseCount": 0
    },
    "logs": [
      {
        "id": "legacy-arousal-log",
        "startedAt": "2026-07-02T12:00:00.000Z",
        "completedAt": "2026-07-02T12:10:00.000Z",
        "dateKey": "2026-07-02",
        "completionStatus": "completed",
        "mode": "onePause",
        "focus": "onePause",
        "adultContent": "yes",
        "firmnessPlan": "finish",
        "endingChoice": "climaxed",
        "reflectionCompleted": true,
        "durationPreference": "estimated",
        "durationSeconds": 600,
        "pauseCount": 1,
        "note": "Legacy session note."
      }
    ]
  },
  "masturbationTracking": {
    "enabled": true,
    "currentSession": {
      "id": "session-feedback",
      "status": "awaiting_feedback",
      "startedAt": "2026-03-01T10:00:00.000Z",
      "endedAt": "2026-03-01T10:05:00.000Z",
      "durationSeconds": 300,
      "pauses": [],
      "usedExplicitContent": false,
      "erectionQuality": 5
    },
    "sessions": [
      {
        "id": "source-session",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 1,
        "usedExplicitContent": true,
        "endingReason": "climaxed",
        "pauses": []
      },
      {
        "id": "session-1",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 10,
        "usedExplicitContent": false,
        "endingReason": "stoppedBeforeClimax",
        "pauses": [
          {
            "status": "completed",
            "startedAt": "2026-02-03T10:02:00.000Z",
            "endedAt": "2026-02-03T10:03:00.000Z",
            "durationSeconds": 60
          }
        ]
      },
      {
        "id": "session-2",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 10,
        "usedExplicitContent": false,
        "endingReason": "firmnessDecreased",
        "pauses": [
          {
            "status": "completed",
            "startedAt": "2026-02-03T10:02:00.000Z",
            "endedAt": "2026-02-03T10:03:00.000Z",
            "durationSeconds": 60
          }
        ]
      },
      {
        "id": "session-3",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 10,
        "usedExplicitContent": false,
        "endingReason": "feltAnxious",
        "pauses": [
          {
            "status": "completed",
            "startedAt": "2026-02-03T10:02:00.000Z",
            "endedAt": "2026-02-03T10:03:00.000Z",
            "durationSeconds": 60
          }
        ]
      },
      {
        "id": "session-4",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 10,
        "usedExplicitContent": false,
        "endingReason": "stoppedByChoice",
        "pauses": [
          {
            "status": "completed",
            "startedAt": "2026-02-03T10:02:00.000Z",
            "endedAt": "2026-02-03T10:03:00.000Z",
            "durationSeconds": 60
          }
        ]
      },
      {
        "id": "session-5",
        "status": "completed",
        "startedAt": "2026-02-03T10:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "durationSeconds": 600,
        "erectionQuality": 10,
        "usedExplicitContent": false,
        "endingReason": "other",
        "pauses": [
          {
            "status": "completed",
            "startedAt": "2026-02-03T10:02:00.000Z",
            "endedAt": "2026-02-03T10:03:00.000Z",
            "durationSeconds": 60
          }
        ]
      }
    ]
  },
  "contentFree": {
    "status": "active",
    "activationId": "cf-current",
    "activatedAt": "2026-02-01T00:00:00.000Z",
    "currentStreakStartedAt": "2026-02-03T10:10:00.000Z",
    "bestStreakSeconds": 1641600,
    "pastActivations": [
      {
        "id": "cf-past",
        "startedAt": "2026-01-01T00:00:00.000Z",
        "endedAt": "2026-01-20T00:00:00.000Z"
      }
    ],
    "violations": [
      {
        "id": "cf-corrected",
        "activationId": "cf-past",
        "kind": "intentionalExplicitContent",
        "occurredAt": "2026-01-10T00:00:00.000Z",
        "recordedAt": "2026-01-10T00:01:00.000Z",
        "source": {
          "kind": "manual",
          "logActionId": "mistaken-manual-log"
        },
        "streakBefore": {
          "currentStreakStartedAt": "2026-01-01T00:00:00.000Z",
          "bestStreakSeconds": 777600
        },
        "status": "undone",
        "undoneAt": "2026-01-11T00:00:00.000Z"
      },
      {
        "id": "cf-recorded",
        "activationId": "cf-current",
        "kind": "intentionalExplicitContent",
        "occurredAt": "2026-02-03T10:10:00.000Z",
        "recordedAt": "2026-02-03T10:11:00.000Z",
        "source": {
          "kind": "masturbationSession",
          "sessionId": "source-session"
        },
        "streakBefore": {
          "currentStreakStartedAt": "2026-02-01T00:00:00.000Z",
          "bestStreakSeconds": 1641600
        },
        "status": "recorded"
      }
    ]
  },
  "resetJourney": {
    "id": "reset-journey",
    "durationDays": 15,
    "status": "completed",
    "startedAt": "2026-02-01T00:00:00.000Z",
    "bestCompletedDays": 15,
    "pastAttempts": [
      {
        "id": "attempt-past",
        "status": "restarted",
        "startedAt": "2026-02-01T00:00:00.000Z",
        "endedAt": "2026-02-03T10:10:00.000Z",
        "completedDays": 2,
        "restartViolationId": "reset-violation"
      }
    ],
    "violations": [
      {
        "status": "recorded",
        "id": "reset-violation",
        "attemptId": "attempt-past",
        "occurredAt": "2026-02-03T10:10:00.000Z",
        "recordedAt": "2026-02-03T10:11:00.000Z",
        "source": {
          "kind": "masturbationSession",
          "sessionId": "source-session"
        },
        "reason": "masturbationWithExplicitContent"
      }
    ],
    "baseline": {
      "id": "baseline",
      "capturedAt": "2026-01-31T00:00:00.000Z",
      "averageIntervalSeconds": 86400.5,
      "averageErectionQuality": 6.5,
      "explicitContentSessionRatio": 0.25,
      "selfReport": {
        "urgeIntensity": "medium",
        "abilityToPause": "sometimesPossible",
        "spontaneousOrMorningErections": "sometimes"
      }
    },
    "completedAt": "2026-02-18T10:10:00.000Z",
    "currentAttempt": {
      "id": "attempt-current",
      "status": "completed",
      "startedAt": "2026-02-03T10:10:00.000Z",
      "completedAt": "2026-02-18T10:10:00.000Z",
      "completedDays": 15
    },
    "assessment": {
      "id": "assessment",
      "resetJourneyId": "reset-journey",
      "resetAttemptId": "attempt-current",
      "baselineId": "baseline",
      "completedAt": "2026-02-18T10:20:00.000Z",
      "urgeIntensityChange": "same",
      "abilityToPauseChange": "easier",
      "spontaneousErectionChange": "notSure",
      "overallSexualResponseChange": "worse",
      "readinessToRestartTracking": "notReady"
    }
  },
  "urgeControl": {
    "activeEvent": {
      "id": "urge-active",
      "status": "active",
      "startedAt": "2026-03-01T11:00:00.000Z",
      "interruptCompletedAt": "2026-03-01T11:00:10.000Z",
      "phoneAwayStartedAt": "2026-03-01T11:01:00.000Z",
      "selectedTechnique": "urgeSurfing",
      "outcome": "stillStrong",
      "trigger": "sleeplessnessNighttime",
      "secondLineAction": "putPhoneInAnotherRoom"
    },
    "records": [
      {
        "id": "urge-completed",
        "status": "completed",
        "startedAt": "2026-02-02T12:00:00.000Z",
        "interruptCompletedAt": "2026-02-02T12:00:10.000Z",
        "phoneAwayStartedAt": "2026-02-02T12:01:00.000Z",
        "phoneAwayEndedAt": "2026-02-02T12:05:00.000Z",
        "completedAt": "2026-02-02T12:06:00.000Z",
        "selectedTechnique": "grounding54321",
        "outcome": "unchanged",
        "trigger": "sexualDesire",
        "secondLineAction": "messageSupportPerson"
      }
    ]
  },
  "productOnboarding": {
    "status": "notCompleted",
    "result": null
  }
};
