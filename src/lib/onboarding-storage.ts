const STORAGE_KEY = "instaclaw-onboarding";

export interface WizardState {
  personality: string;
  customPersonality?: string;
  useCases: string[];
  botName: string;
  extraContext?: string;
  userName: string;
  userDescription?: string;
  currentStep: string;
  selectedPriceId?: string;
  selectedPlanName?: string;
  selectedPlanPrice?: string;
}

const SELECTED_PLAN_KEY = "instaclaw-selected-plan";

export interface SelectedPlan {
  id: string;
  name: string;
  price: string;
}

export function loadSelectedPlan(): SelectedPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTED_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SelectedPlan;
  } catch {
    return null;
  }
}

export function loadWizardState(): WizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WizardState;
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable -- silently ignore
  }
}

export function clearWizardState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
