import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { ChatSurface } from "@/components/ChatSurface";

const DEFAULT_PROFILE_TAGS = [
  "grade:mid_2",
  "subject:math",
  "subject:english",
  "goal:advanced",
  "budget:mid",
];

const PreferenceResult = () => {
  const location = useLocation();

  const profileTags = useMemo(() => {
    const tags = location.state?.profileTags as string[] | undefined;
    return tags?.length ? tags : DEFAULT_PROFILE_TAGS;
  }, [location.state]);

  return (
    <ChatSurface
      profileTags={profileTags}
      title="맞춤 추천"
      showPreferenceMenu
    />
  );
};

export default PreferenceResult;
