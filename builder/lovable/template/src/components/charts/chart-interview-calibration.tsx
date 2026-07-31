import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InterviewCalibration } from "@/components/charts/lib/recruiting"
let s = 806
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const interviewers = ["A. Bakare", "B. Costa", "C. Duval", "D. Ellis", "E. Fischer"]
const candidates = Array.from({ length: 12 }, (_, i) => `Candidate ${i + 1}`)
const truth = candidates.map(() => 1 + rnd() * 3)
const profile = [
  { bias: 0.05, noise: 0.2 },
  { bias: 0.62, noise: 0.18 },
  { bias: -0.48, noise: 0.22 },
  { bias: 0.02, noise: 0.86 },
  { bias: 0.14, noise: 0.3 },
]
const scores: (number | null)[][] = interviewers.map((_, ii) =>
  candidates.map((_, ci) =>
    rnd() < 0.22
      ? null
      : Math.round((truth[ci] + profile[ii].bias + (rnd() - 0.5) * profile[ii].noise * 2) * 10) / 10,
  ),
)
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration</CardTitle>
        <CardDescription>Each interviewer against the panel</CardDescription>
      </CardHeader>
      <CardContent>
        <InterviewCalibration
          interviewers={interviewers}
          candidates={candidates}
          scores={scores}
          bar={2.5}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A bias is correctable and noise is not <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve candidates
        </div>
      </CardFooter>
    </Card>
  )
}
