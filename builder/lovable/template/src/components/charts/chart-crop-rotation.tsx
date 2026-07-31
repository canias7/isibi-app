import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CropRotation } from "@/components/charts/lib/agri"
const fields = ["Home", "Long Acre", "Brook", "Hill", "Fifteen"]
const years = [2021, 2022, 2023, 2024, 2025, 2026]
const grid = [
  ["W wheat", "W barley", "OSR", "W wheat", "Beans", "W wheat"],
  ["Beans", "W wheat", "W barley", "OSR", "W wheat", "W barley"],
  ["OSR", "W wheat", "Beans", "W wheat", "W barley", "OSR"],
  ["W barley", "OSR", "W wheat", "Beans", "W wheat", "W barley"],
  ["W wheat", "Beans", "W wheat", "W barley", "OSR", "W wheat"],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotation plan</CardTitle>
        <CardDescription>Field against year</CardDescription>
      </CardHeader>
      <CardContent>
        <CropRotation fields={fields} years={years} grid={grid} minInterval={3} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The shortest return is the risk <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six years
        </div>
      </CardFooter>
    </Card>
  )
}
