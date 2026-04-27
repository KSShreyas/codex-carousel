import { DurableStore } from './durableStore';
import {
  LimitStatus,
  RecommendationStatus,
  SnapshotStatus,
  SwitchEventType,
  VerificationStatus,
} from './types';

function isCaptured(snapshotStatus: SnapshotStatus) {
  return snapshotStatus === SnapshotStatus.Captured;
}

export function recomputeRecommendations(store: DurableStore) {
  const state = store.getState();
  const active = state.settings.activeProfileId
    ? state.profiles.find((p) => p.id === state.settings.activeProfileId) ?? null
    : null;

  const availableTargets = state.profiles.filter(
    (p) => p.id !== active?.id && (p.fiveHourStatus === LimitStatus.Available || (p.fiveHourStatus === LimitStatus.Unknown && isCaptured(p.snapshotStatus)))
  );

  const allExhausted = state.profiles.length > 0 && state.profiles.every((p) => p.fiveHourStatus === LimitStatus.Exhausted && p.weeklyStatus === LimitStatus.Exhausted);

  const updatedProfiles = state.profiles.map((profile) => {
    let recommendation = RecommendationStatus.Unknown;
    let reason = 'Usage status is unknown.';

    if (profile.fiveHourStatus === LimitStatus.Unknown || profile.weeklyStatus === LimitStatus.Unknown) {
      recommendation = RecommendationStatus.Unknown;
      reason = 'Usage status is unknown.';
    } else if (
      profile.id === active?.id &&
      profile.fiveHourStatus === LimitStatus.Available &&
      profile.weeklyStatus === LimitStatus.Available &&
      profile.verificationStatus !== VerificationStatus.Failed
    ) {
      recommendation = RecommendationStatus.Stay;
      reason = 'Active profile has available observed status.';
    } else if (profile.id === active?.id && (profile.fiveHourStatus === LimitStatus.Low || profile.weeklyStatus === LimitStatus.Low)) {
      recommendation = RecommendationStatus.SwitchSoon;
      reason = 'Active profile observed status is low.';
    } else if (profile.id === active?.id && (profile.fiveHourStatus === LimitStatus.Exhausted || profile.weeklyStatus === LimitStatus.Exhausted)) {
      if (availableTargets.length > 0) {
        recommendation = RecommendationStatus.SwitchNow;
        reason = 'Active profile is exhausted and at least one alternate captured profile is available/unknown.';
      } else if (allExhausted) {
        recommendation = RecommendationStatus.Unknown;
        reason = 'All profiles appear exhausted; wait for reset.';
      } else {
        recommendation = RecommendationStatus.Unknown;
        reason = 'No eligible alternate profile available.';
      }
    }

    if (profile.id !== active?.id && (profile.verificationStatus === VerificationStatus.Unknown || profile.verificationStatus === VerificationStatus.Unverified)) {
      recommendation = RecommendationStatus.VerifyFirst;
      reason = 'Target profile should be verified before switching.';
    }

    return {
      ...profile,
      recommendation,
      recommendationReason: reason,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    profiles: updatedProfiles,
    summary: {
      activeProfileId: active?.id ?? null,
      activeRecommendation: updatedProfiles.find((p) => p.id === active?.id)?.recommendation ?? RecommendationStatus.Unknown,
    },
  };
}

export async function persistRecommendations(store: DurableStore) {
  const result = recomputeRecommendations(store);
  for (const profile of result.profiles) {
    await store.updateProfile(profile.id, {
      recommendation: profile.recommendation,
      recommendationReason: profile.recommendationReason,
    } as any);
  }

  store.appendEvent({
    eventType: SwitchEventType.SWITCH_RECOMMENDED,
    profileId: result.summary.activeProfileId,
    targetProfileId: null,
    severity: 'info',
    message: `Recommendation recomputed: ${result.summary.activeRecommendation}`,
    metadata: result.summary,
  });
  await store.save();
  return result;
}
