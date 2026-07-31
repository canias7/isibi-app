import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BodyComposition } from "@/components/charts/lib/fitness"
const points = Array.from({ length: 9 }, (_, i) => ({
  date: `Wk ${i * 2}`,
  leanKg: 62.4 - i * 0.05,
  fatKg: 21.8 - i * 0.72,
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Body composition</CardTitle>
        <CardDescription>Lean mass held while fat mass falls</CardDescription>
      </CardHeader>
      <CardContent>
        <BodyComposition points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Weight fell 6 kg, lean mass fell 0.4 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Sixteen weeks
        </div>
      </CardFooter>
    </Card>
  )
}
