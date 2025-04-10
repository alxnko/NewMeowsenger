import { Input as HeroInput, InputProps } from "@heroui/input";
import { tv } from "tailwind-variants";
import React from "react";

const inputStyles = tv({
  base: "lowercase",
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface BaseInputProps extends InputProps {}

export const Input = ({
  label,
  className,
  size,
  color = "success",
  variant = "bordered",
  ...props
}: InputProps) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 lowercase">
          {label}
        </label>
      )}
      <HeroInput
        className={inputStyles({ size, className })}
        color={color}
        variant={variant}
        {...props}
      />
    </div>
  );
};

export default Input;
