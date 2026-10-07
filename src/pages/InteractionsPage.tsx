import React from "react";
import { InteractionAnalyzerPage, BasketMedicine, InteractionRecord } from "./InteractionAnalyzerPage";

export type { BasketMedicine, InteractionRecord };
export { InteractionAnalyzerPage };

interface InteractionsPageProps {
  onOpenAiAssistant?: (initialPrompt?: string) => void;
}

export const InteractionsPage: React.FC<InteractionsPageProps> = ({ onOpenAiAssistant }) => {
  return <InteractionAnalyzerPage onOpenAiAssistant={onOpenAiAssistant} />;
};

export default InteractionsPage;
