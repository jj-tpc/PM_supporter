import { memo } from 'react';

export const WelcomeCard = memo(function WelcomeCard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '수고하셨어요';

  return (
    <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
      <p className="text-lg font-semibold text-text-primary">{greeting}</p>
      <p className="text-sm text-text-secondary mt-1">
        오늘 하루도 PM Supporter와 함께 해요.
      </p>
    </div>
  );
});
