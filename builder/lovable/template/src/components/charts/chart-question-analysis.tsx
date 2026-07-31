import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QuestionAnalysis } from "@/components/charts/lib/edu"
const questions = [
  { id: "Q1", facility: 0.96, discrimination: 0.06 },
  { id: "Q2", facility: 0.82, discrimination: 0.34 },
  { id: "Q3", facility: 0.71, discrimination: 0.48 },
  { id: "Q4", facility: 0.58, discrimination: 0.52 },
  { id: "Q5", facility: 0.44, discrimination: 0.41 },
  { id: "Q6", facility: 0.39, discrimination: -0.12 },
  { id: "Q7", facility: 0.28, discrimination: 0.36 },
  { id: "Q8", facility: 0.14, discrimination: 0.21 },
  { id: "Q9", facility: 0.63, discrimination: 0.29 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How each question behaved</CardTitle>
        <CardDescription>Facility against discrimination</CardDescription>
      </CardHeader>
      <CardContent>
        <QuestionAnalysis questions={questions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Below the line the strong did worse <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One paper
        </div>
      </CardFooter>
    </Card>
  )
}
