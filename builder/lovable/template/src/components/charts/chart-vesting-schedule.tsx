import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VestingSchedule } from "@/components/charts/lib/finance2"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vesting</CardTitle>
        <CardDescription>Four years with a one-year cliff</CardDescription>
      </CardHeader>
      <CardContent>
        <VestingSchedule total={40000} months={48} cliffMonths={12} elapsedMonths={19} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing, then a quarter at once <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          48 months
        </div>
      </CardFooter>
    </Card>
  )
}
