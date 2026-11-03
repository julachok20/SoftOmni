# Personalized sublesson paths — v49

Main topics use their existing knowledge objectives as ordered required sublessons. Advanced and contest lessons are optional extensions after the core path. Preferences (explanation, interests, pace), unfinished conversations, support requests, and activity completion are account-scoped in local browser storage via Learning.data. These new fields are not cloud-synced. Existing assessment records are preserved when reopening a lesson.

AI requests carry current sublesson, stage, preferences and recent support requests in context, preserving prior caller context and conversation history. Adaptation is requested from the existing tutor backend; no new model or key required.

Activity completion requires successful replies in all five stages and three learner submissions in independent practice. It measures participation, not correctness or mastery. The chapter assessment opens after all core activities; existing scored assessment requirements remain separate.

Validation: staged browser workflow with mocked tutor responses; actual Tutor.ask request payload capture; premature completion denied; sequential unlock; account isolation; preserved scores; mobile overflow check passed. 3,200 foundation question checks passed. Existing math-rendering regression blocked by ERR_NETWORK_ACCESS_DENIED for external KaTeX CDN. Live model quality was not tested. Frontend v49 is local and requires deployment.
