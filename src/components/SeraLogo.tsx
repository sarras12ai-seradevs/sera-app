import React from "react";
import seraLogoImg from "../assets/images/sera_logo_icon_1791467838609.jpg";

interface SeraLogoProps {
  className?: string;
  alt?: string;
}

export const SeraLogo: React.FC<SeraLogoProps> = ({
  className = "w-10 h-10",
  alt = "SERA Logo",
}) => {
  return (
    <img
      src={seraLogoImg}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`object-cover rounded-xl border border-emerald-200/80 dark:border-emerald-700/60 shadow-2xs shrink-0 select-none ${className}`}
    />
  );
};
