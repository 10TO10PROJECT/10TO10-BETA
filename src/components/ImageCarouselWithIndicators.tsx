import { useState, useRef, useEffect } from "react";

interface ImageCarouselWithIndicatorsProps {
  imageUrls: string[];
  title: string;
}

const ImageCarouselWithIndicators = ({ imageUrls, title }: ImageCarouselWithIndicatorsProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update current index based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const itemWidth = container.offsetWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      setCurrentIndex(newIndex);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToIndex = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const itemWidth = container.offsetWidth;
    container.scrollTo({
      left: index * itemWidth,
      behavior: "smooth"
    });
  };

  return (
    <div className="max-w-lg mx-auto relative">
      {/* Horizontal scroll with snap */}
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {imageUrls.map((url, idx) => (
          <div 
            key={idx} 
            className="shrink-0 w-full snap-center"
            style={{ scrollSnapAlign: 'center' }}
          >
            <div className="bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/30 overflow-hidden">
              <img
                src={url}
                alt={`${title} - ${idx + 1}`}
                className="block w-full h-auto"
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Carousel Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {imageUrls.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              idx === currentIndex 
                ? "bg-primary w-4" 
                : "bg-card/60 hover:bg-card/80"
            }`}
            aria-label={`Go to image ${idx + 1}`}
          />
        ))}
      </div>

      {/* Image Counter */}
      <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-foreground">
        {currentIndex + 1} / {imageUrls.length}
      </div>
    </div>
  );
};

export default ImageCarouselWithIndicators;
