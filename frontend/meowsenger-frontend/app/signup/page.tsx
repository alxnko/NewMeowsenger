import Container from "@/components/elements/container";
import { subtitle, title } from "@/components/primitives";
import React from "react";

export default function SignUpPage() {
  return (
    <Container>
      <p>
        sign up <br />
        to use <span className="text-green-500">meowsenger</span>
      </p>
    </Container>
  );
}
