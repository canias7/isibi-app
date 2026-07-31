import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrowthYield } from "@/components/charts/lib/forestry"
const volumes = Array.from({ length: 15 }, (_, i) => {
  const age = 10 + i * 5
  return { age, volumeM3: 900 / (1 + Math.exp(-(age - 42) / 11)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth and yield</CardTitle>
        <CardDescription>Volume with MAI and CAI derived from it</CardDescription>
      </CardHeader>
      <CardContent>
        <GrowthYield volumes={volumes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Rotation age is where MAI peaks <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Sitka, YC 18
        </div>
      </CardFooter>
    </Card>
  )
}
