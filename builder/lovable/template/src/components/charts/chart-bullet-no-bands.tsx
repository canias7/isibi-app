import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Bullet, BulletList } from "./lib/bullet"

const items = [
  { label: "Bookings", value: 268, target: 300, max: 400 },
  { label: "Revenue", value: 8420, target: 7500, max: 10000, format: (n: number) => "£" + n.toLocaleString() },
  { label: "New customers", value: 41, target: 60, max: 80 },
  { label: "Repeat rate", value: 62, target: 55, max: 100, format: (n: number) => n + "%" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bullet</CardTitle>
        <CardDescription>Bands removed.</CardDescription>
      </CardHeader>
      <CardContent>
        <Bullet label="Bookings" value={268} target={300} max={400} bands={[]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          89% of target <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
