import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RecoveryCurve } from "@/components/charts/lib/mining"
const points = [
  { grade: 0.4, recovery: 0.741 }, { grade: 0.6, recovery: 0.812 }, { grade: 0.8, recovery: 0.856 },
  { grade: 1.0, recovery: 0.884 }, { grade: 1.3, recovery: 0.906 }, { grade: 1.7, recovery: 0.921 },
  { grade: 2.2, recovery: 0.931 }, { grade: 2.8, recovery: 0.937 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mill recovery</CardTitle>
        <CardDescription>A function of feed grade, not a constant</CardDescription>
      </CardHeader>
      <CardContent>
        <RecoveryCurve points={points} budgetRecovery={0.91} feedGrade={0.86} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The grade fell and the recovery went with it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Plant data, 18 months
        </div>
      </CardFooter>
    </Card>
  )
}
