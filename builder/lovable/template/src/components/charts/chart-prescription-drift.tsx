import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrescriptionDrift } from "@/components/charts/lib/optical"
const tests = [
  { date: "2019", sphere: -2.25, cylinder: -0.5 },
  { date: "2020", sphere: -2.5, cylinder: -0.5 },
  { date: "2021", sphere: -2.25, cylinder: -0.75 },
  { date: "2022", sphere: -2.75, cylinder: -0.75 },
  { date: "2023", sphere: -3.25, cylinder: -0.75 },
  { date: "2024", sphere: -3.5, cylinder: -1 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescription</CardTitle>
        <CardDescription>What a change has to beat</CardDescription>
      </CardHeader>
      <CardContent>
        <PrescriptionDrift tests={tests} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Imprecise and biased are different problems <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six tests
        </div>
      </CardFooter>
    </Card>
  )
}
