import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

const PasswordInput: React.FC<Props> = ({ className = '', ...rest }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={show ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? '隱藏密碼' : '顯示密碼'}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default PasswordInput;
