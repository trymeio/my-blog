"use client";
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { siteConfig } from '../siteConfig';

export default function BackgroundSlider() {
  const [isMobile, setIsMobile] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const pathname = usePathname();
  
  // 电脑端三张背景图
  const desktopImages = ["/background.jpg", "/desktop-bg2.jpg", "/desktop-bg3.jpg"];
  const mobileImages = ["/mobile-bg1.jpg", "/mobile-bg2.jpg", "/mobile-bg3.jpg"];
  
  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 页面切换时随机选择背景图（1/3概率）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const randomIndex = Math.floor(Math.random() * 3);
      setBgIndex(randomIndex);
    }
  }, [pathname]);
  
  const images = isMobile ? mobileImages : desktopImages;
  
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
            opacity: i === bgIndex ? 1 : 0,
            // 解决层级重叠导致的渲染压力
            visibility: Math.abs(i - bgIndex) <= 1 || (i === images.length - 1 && bgIndex === 0) ? 'visible' : 'hidden'
          }}
        />
      ))}
    </div>
  );
}
