import { ButtonProps, Button as HeroButton } from "@heroui/button";
import { tv } from "tailwind-variants";
import React from "react";

const buttonStyles = tv({
  base: "transition-all lowercase",
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

export const Button = ({
  children,
  className,
  size,
  color = "success",
  ...props
}: ButtonProps) => {
  return (
    <HeroButton
      className={buttonStyles({ size, className })}
      color={color}
      {...props}
    >
      {children}
    </HeroButton>
  );
};

export default Button;
