import React from 'react';

const Dot = ({ color = '#2BA84A', size = 10, delay = '0ms' }) => (
  <span
    style={{
      backgroundColor: color,
      width: size,
      height: size,
      animationDelay: delay,
    }}
    className="inline-block rounded-full mx-1 animate-bounce"
  />
);

const DotsLoader = ({ centered = false, size = 10, className = '' }) => {
  const wrapCls = centered ? 'w-full flex justify-center items-center py-3' : '';
  return (
    <div className={`${wrapCls} ${className}`.trim()} aria-label="Chargement">
      <Dot color="#2BA84A" size={size} delay="0ms" />
      <Dot color="#E0222A" size={size} delay="120ms" />
      <Dot color="#F5C300" size={size} delay="240ms" />
    </div>
  );
};

export default DotsLoader;
