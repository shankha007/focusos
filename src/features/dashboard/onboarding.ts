/**
 * Whether to show the first-run welcome.
 *
 * `onboarded` has been stored since the first version and defaulted to false
 * for everyone, implying a tour that was never built. Building one now means
 * the flag alone would greet every existing user with an introduction to an app
 * they already use. Anyone with a session logged is past their first run, so
 * they never see it — and nothing has to be migrated to make that true.
 */
export function shouldShowWelcome(onboarded: boolean, sessionCount: number): boolean {
  return !onboarded && sessionCount === 0;
}
