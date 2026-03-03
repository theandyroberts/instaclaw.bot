import {
  PenLine,
  TrendingUp,
  Briefcase,
  Heart,
  Sparkles,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const DEFAULT_USER_DESCRIPTION = `I'm a driven and curious person who loves learning new things. I'm always looking for ways to be more productive. I enjoy creative projects, staying organized, and having interesting conversations. I appreciate humor, directness, and thoughtful advice.`;

export interface LoopOption {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const LOOP_OPTIONS: LoopOption[] = [
  {
    id: "better-writer",
    label: "Better Writer",
    description: "I want to be a better writer",
    icon: PenLine,
  },
  {
    id: "grow-business",
    label: "Grow My Business",
    description: "I want to grow my business",
    icon: TrendingUp,
  },
  {
    id: "work-assistant",
    label: "Work Assistant",
    description: "I want an assistant to help with my work",
    icon: Briefcase,
  },
  {
    id: "health-habits",
    label: "Better Habits",
    description: "I want to build better habits",
    icon: Heart,
  },
  {
    id: "learn-explore",
    label: "Learn Something New",
    description: "I want to learn something new every day",
    icon: Sparkles,
  },
  {
    id: "just-exploring",
    label: "Just Exploring",
    description: "I'm just checking the technology out",
    icon: Eye,
  },
];

export const LOOP_PROMPTS: Record<string, string> = {
  "better-writer":
    "Review our recent conversations and any writing projects. Suggest one short writing exercise for today. If there's a draft in progress, propose a next step.",
  "grow-business":
    "Check in on business projects or goals we've discussed. Suggest one actionable task for today -- specific and achievable in under an hour.",
  "work-assistant":
    "Review pending tasks, deadlines, or projects from our conversations. Give me 2-3 priorities for today and offer to help with the first one.",
  "health-habits":
    "Check in on habits or health goals we've discussed. Ask how yesterday went, suggest one small action for today, and offer encouragement.",
  "learn-explore":
    "Pick an interesting topic related to my interests and teach me something new in 2-3 paragraphs. Suggest a follow-up question or activity.",
};
