import React from "react";
import { tv } from "tailwind-variants";

// Card component styles
const cardStyles = tv({
  base: "bg-card rounded-xl shadow-md overflow-hidden transition-all",
});

const headerStyles = tv({
  base: "p-4 border-b border-neutral-100 dark:border-neutral-800",
});

const bodyStyles = tv({
  base: "p-4",
});

const footerStyles = tv({
  base: "p-4 border-t border-neutral-100 dark:border-neutral-800",
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = ({ children, className, ...props }: CardProps) => {
  return (
    <div className={cardStyles({ className })} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={headerStyles({ className })} {...props}>
      {children}
    </div>
  );
};

export const CardBody = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={bodyStyles({ className })} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={footerStyles({ className })} {...props}>
      {children}
    </div>
  );
};

export default Card;
