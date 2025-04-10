"use client";
import { Snippet } from "@heroui/snippet";

import { title, subtitle } from "@/components/primitives";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import Container from "@/components/elements/container";
import { ProtectedRoute } from "@/components/elements/protected-route";

export default function Home() {
  const router = useRouter();

  return (
    <ProtectedRoute authRedirect={true}>
      <Container>
        <div className="inline-block max-w-xl text-center justify-center">
          <span className={title()}>use </span>
          <span className={title({ color: "green" })}>meowsenger</span>
          <br />
          <span className={title()}>for messaging</span>
          <div className={subtitle({ class: "mt-4" })}>
            beautiful, fast <br />
            and modern messenger
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 items-center">
          <Snippet hideCopyButton hideSymbol variant="bordered">
            <span>
              start messaging by{" "}
              <Button
                as={Link}
                href={ROUTES.signup}
                variant="flat"
                color="danger"
              >
                signing up
              </Button>
            </span>
          </Snippet>
          <div className="text-sm text-neutral-500">
            already have an account?{" "}
            <Button
              size="sm"
              as={Link}
              href={ROUTES.login}
              variant="flat"
              color="success"
            >
              login
            </Button>
          </div>
        </div>
      </Container>
    </ProtectedRoute>
  );
}
