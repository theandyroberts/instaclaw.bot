"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_USER_DESCRIPTION } from "@/lib/onboarding-defaults";

interface BotConfig {
  botName: string;
  personality: string;
  customPersonality?: string;
  userName: string;
  userDescription?: string;
  timezone?: string;
  jobTitle?: string;
  useCases: string[];
  extraContext?: string;
}

interface StepAboutYouProps {
  config: BotConfig;
  onUpdate: (updates: Partial<BotConfig>) => void;
  onNext: () => void;
  onBack: () => void;
  sessionName?: string;
}

const timezones = [
  // US timezones first
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  // International
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Sao_Paulo", label: "S\u00e3o Paulo (BRT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris / Berlin (CET)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
];

const jobTitles = [
  "Software Engineer",
  "Designer",
  "Product Manager",
  "Marketing Manager",
  "Sales Representative",
  "Entrepreneur / Founder",
  "Consultant",
  "Writer / Content Creator",
  "Teacher / Professor",
  "Student",
  "Executive / C-Suite",
  "Healthcare Professional",
  "Legal Professional",
  "Financial Analyst",
  "Project Manager",
  "Data Scientist",
  "Customer Support",
  "HR / People Operations",
  "Operations Manager",
  "Freelancer",
  "Retired",
];

export function StepAboutYou({
  config,
  onUpdate,
  onNext,
  onBack,
  sessionName,
}: StepAboutYouProps) {
  const [userName, setUserName] = useState(
    config.userName || sessionName || "Friend"
  );
  const [timezone, setTimezone] = useState(config.timezone || "");
  const [jobTitle, setJobTitle] = useState(config.jobTitle || "");
  const [customJobTitle, setCustomJobTitle] = useState(
    config.jobTitle && !jobTitles.includes(config.jobTitle) ? config.jobTitle : ""
  );
  const [isCustomJob, setIsCustomJob] = useState(
    !!config.jobTitle && !jobTitles.includes(config.jobTitle)
  );
  const [userDescription, setUserDescription] = useState(
    config.userDescription || DEFAULT_USER_DESCRIPTION
  );

  const canProceed = userName.trim().length > 0;

  const resolvedJobTitle = isCustomJob ? customJobTitle.trim() : jobTitle;

  const handleJobChange = (value: string) => {
    if (value === "__other__") {
      setIsCustomJob(true);
      setJobTitle("");
    } else {
      setIsCustomJob(false);
      setJobTitle(value);
      setCustomJobTitle("");
    }
  };

  const handleNext = () => {
    onUpdate({
      userName: userName.trim(),
      timezone: timezone || undefined,
      jobTitle: resolvedJobTitle || undefined,
      userDescription: userDescription.trim() || undefined,
    });
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100">
          Tell your bot about yourself
        </h2>
        <p className="mt-3 text-lg text-gray-400">
          We wrote a starting point -- edit it to get better results.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Help your bot personalize responses to you
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="userName">Your Name</Label>
          <Input
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            maxLength={100}
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Your Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select your timezone...</option>
            <optgroup label="United States">
              {timezones.slice(0, 6).map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </optgroup>
            <optgroup label="International">
              {timezones.slice(6).map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">What do you do?</Label>
          <select
            id="jobTitle"
            value={isCustomJob ? "__other__" : jobTitle}
            onChange={(e) => handleJobChange(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select your role...</option>
            {jobTitles.map((title) => (
              <option key={title} value={title}>{title}</option>
            ))}
            <option value="__other__">Other...</option>
          </select>
          {isCustomJob && (
            <Input
              placeholder="Type your role..."
              value={customJobTitle}
              onChange={(e) => setCustomJobTitle(e.target.value)}
              maxLength={100}
              className="h-12"
              autoFocus
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="userDescription">
            About You
          </Label>
          <textarea
            id="userDescription"
            className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            maxLength={1000}
          />
          <p className="text-sm text-gray-500">
            Edit freely -- this helps your bot personalize its responses.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleNext}
          disabled={!canProceed}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
