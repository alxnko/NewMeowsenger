import React, { ReactNode } from "react";
import {
  Modal as HeroModal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalProps as HeroModalProps,
} from "@heroui/modal";

export interface ModalProps extends HeroModalProps {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
  position?: "top" | "center" | "bottom";
}

export const Modal = ({
  children,
  title,
  footer,
  size = "md",
  position = "top",
  ...props
}: ModalProps) => {
  // Define position classes
  const positionClasses = {
    top: "mt-[5vh] mb-auto",
    center: "my-auto",
    bottom: "mt-auto mb-[5vh]",
  };

  return (
    <HeroModal
      {...props}
      classNames={{
        backdrop: "z-[1000]",
        wrapper: "z-[1001] items-start", // Using items-start to position at the top by default
        ...props.classNames,
      }}
    >
      <ModalContent
        className={`z-[1001] ${positionClasses[position]} ${
          props.className || ""
        }`}
      >
        {title && <ModalHeader className="lowercase">{title}</ModalHeader>}
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </HeroModal>
  );
};

export {
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalContent,
} from "@heroui/modal";

export default Modal;
