import React from 'react';
import { Check } from 'lucide-react';

const OfficialBadge = ({ className = '' }) => {
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-[#F5C300] text-white h-5 w-5 ${className}`}>
      <Check className="h-3 w-3" />
    </span>
  );
};

export default OfficialBadge;
