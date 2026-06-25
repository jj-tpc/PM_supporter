// renderer/components/deepwork/FirstTimeGuide.tsx
import { memo, useState } from 'react';

interface Props {
  onDismiss: () => void;
}

const slides = [
  {
    title: '화면이 이렇게 바뀝니다',
    description: '다크 테마, 사이드바 숨김, 풀스크린 \u2014 집중할 수 있는 환경이 됩니다.',
  },
  {
    title: '이런 기능이 켜집니다',
    description: '포모도로 타이머로 시간을 관리하고, 체크리스트로 진행 상황을 확인하세요.',
  },
  {
    title: '나갈 때는 이렇게',
    description: 'Esc를 두 번 누르거나 우상단 종료 버튼을 클릭하세요. 참고 패널로 다른 뷰를 잠깐 볼 수도 있습니다.',
  },
];

export const FirstTimeGuide = memo(function FirstTimeGuide({ onDismiss }: Props) {
  const [current, setCurrent] = useState(0);
  const [neverShow, setNeverShow] = useState(false);

  const isLast = current === slides.length - 1;

  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-surface-raised rounded-xl p-8 max-w-md w-full shadow-2xl">
        {/* Slide indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === current ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold text-text-primary text-center mb-2">
          {slides[current].title}
        </h3>
        <p className="text-sm text-text-secondary text-center mb-8">
          {slides[current].description}
        </p>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={neverShow}
              onChange={(e) => setNeverShow(e.target.checked)}
              className="rounded"
            />
            다시 안 보기
          </label>

          <div className="flex gap-2">
            {current > 0 && (
              <button
                onClick={() => setCurrent(current - 1)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              >
                이전
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
              >
                시작하기
              </button>
            ) : (
              <button
                onClick={() => setCurrent(current + 1)}
                className="px-3 py-1.5 text-sm bg-accent text-surface-raised rounded hover:bg-accent-hover"
              >
                다음
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
