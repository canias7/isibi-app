import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AttackTree } from "@/components/charts/lib/netsec"
const root = {
  goal: "Take over an account", kind: "or" as const,
  children: [
    { goal: "Steal the password", kind: "or" as const, children: [
      { goal: "Phish the user", cost: 40 },
      { goal: "Credential stuffing", cost: 15 },
      { goal: "Keylogger on device", cost: 220 },
    ] },
    { goal: "Bypass the second factor", kind: "and" as const, children: [
      { goal: "SIM swap", cost: 300 },
      { goal: "Know the number", cost: 20 },
    ] },
    { goal: "Session hijack", kind: "and" as const, children: [
      { goal: "XSS on the app", cost: 180 },
      { goal: "Get the user to click", cost: 35 },
    ] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ways in</CardTitle>
        <CardDescription>Cost of the cheapest route</CardDescription>
      </CardHeader>
      <CardContent>
        <AttackTree root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An attacker takes the easiest way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Account takeover
        </div>
      </CardFooter>
    </Card>
  )
}
