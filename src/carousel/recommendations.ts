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

const SAFE_TEXT = {
  stay: 'Stay on this profile',
  low: 'Usage status low, consider choosing another available profile before starting a large task',
  unavailable: 'Current profile appears unavailable based on your manual snapshot',
  verify: 'Verify this profile before using it',
  unknown: 'No recommendation because usage status is unknown',
};

export function recomputeRecommendations(store: DurableStore) {
  const state = store.getState();
  const active = state.settings.activeProfileId
    ? state.profiles.find((p) => p.id === state.settings.activeProfileId) ?? null
    : null;

  const availableTargets = state.profiles.filter(
    (p) => p.id !== active?.id && (p.fiveHourStatus === LimitStatus.Available || (p.fiveHourStatus === LimitStatus.Unknown && isCaptured(p.snapshotStatus))),
  );

  const updatedProfiles = state.profiles.map((profile) => {
    let recommendation = RecommendationStatus.Unknown;
    let reason = SAFE_TEXT.unknown;

    const hasUnknownUsage = profile.fiveHourStatus === LimitStatus.Unknown || profile.weeklyStatus === LimitStatus.Unknown;

    if (hasUnknownUsage) {
      recommendation = RecommendationStatus.Unknown;
      reason = SAFE_TEXT.unknown;
    } else if (
      profile.id === active?.id &&
      profile.fiveHourStatus === LimitStatus.Available &&
      profile.weeklyStatus === LimitStatus.Available &&
      profile.verificationStatus !== VerificationStatus.Failed
    ) {
      recommendation = RecommendationStatus.Stay;
      reason = SAFE_TEXT.stay;
    } else if (profile.id === active?.id && (profile.fiveHourStatus === LimitStatus.Low || profile.weeklyStatus === LimitStatus.Low)) {
      recommendation = RecommendationStatus.SwitchSoon;
      reason = SAFE_TEXT.low;
    } else if (profile.id === active?.id && (profile.fiveHourStatus === LimitStatus.Exhausted || profile.weeklyStatus === LimitStatus.Exhausted)) {
      recommendation = RecommendationStatus.SwitchNow;
      reason = availableTargets.length > 0 ? SAFE_TEXT.low : SAFE_TEXT.unavailable;
    }

    if (profile.id !== active?.id && (profile.verificationStatus === VerificationStatus.Unknown || profile.verificationStatus === VerificationStatus.Unverified)) {
      recommendation = RecommendationStatus.VerifyFirst;
      reason = SAFE_TEXT.verify;
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
