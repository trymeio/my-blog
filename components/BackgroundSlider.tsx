"use client";
import { useState, useEffect } from 'react';
import { siteConfig } from '../siteConfig';

export default function BackgroundSlider() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileBgIndex, setMobileBgIndex] = useState(0);
  const [index, setIndex] = useState(0);
  
  const desktopImages = siteConfig.bgImages;
  const mobileImages = ["/mobile-bg1.jpg", "/mobile-bg2.jpg", "/mobile-bg3.jpg"];
  
  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // 手机端随机选择一张背景图（1/3概率）
    if (typeof window !== 'undefined') {
      const randomIndex = Math.floor(Math.random() * 3);
      setMobileBgIndex(randomIndex);
    }
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 电脑端定时切换背景
  useEffect(() => {
    if (isMobile || desktopImages.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % desktopImages.length);
    }, 10000); // 10秒切换一次
    return () => clearInterval(timer);
  }, [isMobile, desktopImages.length]);
  
  const images = isMobile ? mobileImages : desktopImages;
  const currentIndex = isMobile ? mobileBgIndex : index;
  
  return (
    <div className="absolute inset-0 z-[-10] overflow-hidden">
      {images.map((img, i) => (
        <div
          key={img}
          className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out transform-gpu"
          style={{
            backgroundImage: `url(${img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            // 当前显示的图片 opacity 为 1，其他的为 0
            opacity: i === currentIndex ? 1 : 0,
            // 解决层级重叠导致的渲染压力
            visibility: Math.abs(i - currentIndex) <= 1 || (i === images.length - 1 && currentIndex === 0) ? 'visible' : 'hidden'
          }}
        />
      ))}
    </div>
  );
}
