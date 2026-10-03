import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Sparkles } from "lucide-react";

interface Question {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
}

const questions: Question[] = [
  {
    id: 1,
    question: "모르는 문제가 생겼을 때 자녀는?",
    optionA: "스스로 끝까지 풀어본다",
    optionB: "바로 선생님께 질문한다",
  },
  {
    id: 2,
    question: "더 선호하는 학습 분위기는?",
    optionA: "조용한 독서실 스타일",
    optionB: "활기찬 강의실 스타일",
  },
  {
    id: 3,
    question: "학원의 관리 방식 중 중요한 것은?",
    optionA: "꼼꼼한 학습 피드백",
    optionB: "엄격한 출결 및 숙제 검사",
  },
  {
    id: 4,
    question: "시험 점수가 낮게 나왔을 때?",
    optionA: "혼자 오답 정리하며 복습",
    optionB: "선생님과 1:1 보충 수업",
  },
];

type Answer = "A" | "B";

const LearningStyleTest = () => {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleAnswer = (answer: Answer) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Last question answered, show analyzing animation
      setIsAnalyzing(true);
      
      // Determine learning style based on answers
      const aCount = newAnswers.filter(a => a === "A").length;
      let learningStyle: string;
      
      if (aCount >= 3) {
        learningStyle = "self_directed"; // 자기주도형
      } else if (aCount === 2 && newAnswers[0] === "A") {
        learningStyle = "balanced"; // 균형형
      } else if (aCount === 2) {
        learningStyle = "interactive"; // 소통형
      } else {
        learningStyle = "mentored"; // 밀착관리형
      }

      // Navigate to result after animation
      setTimeout(() => {
        navigate(`${prefix}/learning-style-result`, { 
          state: { 
            learningStyle,
            answers: newAnswers 
          } 
        });
      }, 2500);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setAnswers(answers.slice(0, -1));
    } else {
      navigate(-1);
    }
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-app-shell flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-full gradient-primary flex items-center justify-center animate-pulse">
              <Sparkles className="w-12 h-12 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-4 border-primary/30 animate-ping" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">성향 분석 중...</h2>
            <p className="text-muted-foreground">
              답변을 바탕으로 최적의 학원 유형을 찾고 있어요
            </p>
          </div>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-app-shell">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {currentQuestion + 1}/{questions.length}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Question Number */}
          <div className="text-center">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full gradient-primary text-primary-foreground font-bold">
              Q{question.id}
            </span>
          </div>

          {/* Question */}
          <h1 className="text-xl font-bold text-foreground text-center leading-relaxed">
            {question.question}
          </h1>

          {/* Answer Options */}
          <div className="space-y-4 pt-4">
            <Card
              className="p-6 cursor-pointer border-2 border-border hover:border-primary hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
              onClick={() => handleAnswer("A")}
            >
              <div className="flex items-center gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                  A
                </span>
                <p className="text-foreground font-medium">{question.optionA}</p>
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer border-2 border-border hover:border-primary hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
              onClick={() => handleAnswer("B")}
            >
              <div className="flex items-center gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary text-secondary-foreground font-bold flex items-center justify-center">
                  B
                </span>
                <p className="text-foreground font-medium">{question.optionB}</p>
              </div>
            </Card>
          </div>

          {/* Hint */}
          <p className="text-center text-sm text-muted-foreground">
            직감적으로 더 가까운 답을 선택해주세요
          </p>
        </div>
      </main>
    </div>
  );
};

export default LearningStyleTest;