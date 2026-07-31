import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClassBalance } from "@/components/charts/lib/mldata"
const classes = [
  { name: "no fault", count: 48200 },
  { name: "minor fault", count: 6100 },
  { name: "needs service", count: 1840 },
  { name: "critical", count: 310 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Examples per class</CardTitle>
        <CardDescription>And what guessing the biggest one scores</CardDescription>
      </CardHeader>
      <CardContent>
        <ClassBalance classes={classes} modelAccuracy={0.943} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A model must beat the majority baseline <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Training set
        </div>
      </CardFooter>
    </Card>
  )
}
