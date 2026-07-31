import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DrivePeriods } from "@/components/charts/lib/freight"
const segments = [
  { kind: "other work" as const, minutes: 25 },
  { kind: "drive" as const, minutes: 165 },
  { kind: "break" as const, minutes: 20 },
  { kind: "drive" as const, minutes: 95 },
  { kind: "other work" as const, minutes: 40 },
  { kind: "drive" as const, minutes: 55 },
  { kind: "break" as const, minutes: 45 },
  { kind: "drive" as const, minutes: 175 },
  { kind: "poa" as const, minutes: 35 },
  { kind: "drive" as const, minutes: 60 },
  { kind: "other work" as const, minutes: 20 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Driving hours</CardTitle>
        <CardDescription>Driving since the last qualifying break</CardDescription>
      </CardHeader>
      <CardContent>
        <DrivePeriods segments={segments} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A short break does not reset the clock <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One shift
        </div>
      </CardFooter>
    </Card>
  )
}
