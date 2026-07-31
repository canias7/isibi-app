import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoanSchedule } from "@/components/charts/lib/museum"
const objects = [
  { name: "Watercolour, Cotman", restMonths: 36, loans: [
    { venue: "Norwich", fromMonth: 2, toMonth: 6 },
    { venue: "Leeds", fromMonth: 30, toMonth: 34 },
    { venue: "Paris", fromMonth: 41, toMonth: 46, requested: true },
  ] },
  { name: "Silk banner", restMonths: 48, loans: [
    { venue: "Manchester", fromMonth: 0, toMonth: 5 },
    { venue: "Cardiff", fromMonth: 26, toMonth: 31, requested: true },
  ] },
  { name: "Bronze figure", restMonths: 6, loans: [
    { venue: "Edinburgh", fromMonth: 4, toMonth: 10 },
    { venue: "Bristol", fromMonth: 18, toMonth: 24 },
    { venue: "Dublin", fromMonth: 33, toMonth: 39, requested: true },
  ] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan schedule</CardTitle>
        <CardDescription>Rest is a property of the object</CardDescription>
      </CardHeader>
      <CardContent>
        <LoanSchedule objects={objects} today={20} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two requests cannot be met at all <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five years
        </div>
      </CardFooter>
    </Card>
  )
}
