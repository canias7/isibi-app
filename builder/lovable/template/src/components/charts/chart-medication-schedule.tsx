import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MedicationSchedule } from "@/components/charts/lib/med2"
const drugs = [
  { name: "Metformin", dose: "500 mg", hours: [8, 20], withFood: true },
  { name: "Ramipril", dose: "5 mg", hours: [8] },
  { name: "Atorvastatin", dose: "20 mg", hours: [22], note: "evening" },
  { name: "Levothyroxine", dose: "75 µg", hours: [6], note: "before breakfast" },
  { name: "Paracetamol", dose: "1 g", hours: [8, 14, 20] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily medicines</CardTitle>
        <CardDescription>What is taken when</CardDescription>
      </CardHeader>
      <CardContent>
        <MedicationSchedule drugs={drugs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A filled dot is one dose <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Current list
        </div>
      </CardFooter>
    </Card>
  )
}
