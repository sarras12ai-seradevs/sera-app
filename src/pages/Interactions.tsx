import React from "react";
import { InteractionAnalyzerPage, BasketMedicine, InteractionRecord } from "./InteractionAnalyzerPage";

export type { BasketMedicine, InteractionRecord };
export { InteractionAnalyzerPage };

interface InteractionsProps {
  onOpenAiAssistant?: (initialPrompt?: string) => void;
}

export const Interactions: React.FC<InteractionsProps> = ({ onOpenAiAssistant }) => {
  return <InteractionAnalyzerPage onOpenAiAssistant={onOpenAiAssistant} />;
};

export default Interactions;
