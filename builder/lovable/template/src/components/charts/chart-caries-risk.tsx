import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CariesRisk } from "@/components/charts/lib/dentistry"
const factors = [
  { name: "Past experience", weight: 3, modifiable: false },
  { name: "Sugar frequency", weight: 3, modifiable: true },
  { name: "Fluoride exposure", weight: 2, modifiable: true },
  { name: "Plaque control", weight: 2, modifiable: true },
  { name: "Dry mouth", weight: 2, modifiable: false },
  { name: "Social factors", weight: 1, modifiable: false },
]
const patients = [
  { name: "Patient A", scores: [1, 0.9, 0.8, 0.9, 0.2, 0.6] },
  { name: "Patient B", scores: [0.9, 0.2, 0.1, 0.3, 0.9, 0.4] },
  { name: "Patient C", scores: [0.3, 0.8, 0.7, 0.8, 0.1, 0.2] },
  { name: "Patient D", scores: [0.1, 0.2, 0.1, 0.2, 0, 0.1] },
  { name: "Patient E", scores: [0.7, 0.6, 0.5, 0.4, 0.6, 0.8] },
  { name: "Patient F", scores: [0.4, 0.9, 0.9, 0.7, 0.1, 0.3] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caries risk</CardTitle>
        <CardDescription>Which half of the score can change</CardDescription>
      </CardHeader>
      <CardContent>
        <CariesRisk patients={patients} factors={factors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A filed category drives a recall and says nothing to do <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six patients
        </div>
      </CardFooter>
    </Card>
  )
}
