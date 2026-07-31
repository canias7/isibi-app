import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DispenseRate } from "@/components/charts/lib/optical"
const testTypes = [
  { name: "Private, full sight test", tests: 412, dispenses: 218, meanDispenseValue: 214, feeRecovered: 28 },
  { name: "NHS entitled, adult", tests: 386, dispenses: 168, meanDispenseValue: 96, feeRecovered: 23.53 },
  { name: "NHS, under 16", tests: 241, dispenses: 174, meanDispenseValue: 62, feeRecovered: 23.53 },
  { name: "Contact lens aftercare", tests: 168, dispenses: 41, meanDispenseValue: 148, feeRecovered: 34 },
  { name: "Free test promotion", tests: 194, dispenses: 48, meanDispenseValue: 118 },
  { name: "Domiciliary visit", tests: 61, dispenses: 39, meanDispenseValue: 141, feeRecovered: 46.2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispensing</CardTitle>
        <CardDescription>Value per test, not rate</CardDescription>
      </CardHeader>
      <CardContent>
        <DispenseRate testTypes={testTypes} testCost={38} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rate on its own cannot price a scheme <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
