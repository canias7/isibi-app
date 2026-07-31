import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StringMismatch } from "@/components/charts/lib/solar"
const strings = [
  { name: "String A · binned", modules: [11.32, 11.35, 11.29, 11.34, 11.31, 11.36, 11.3, 11.33].map((impp, i) => ({ name: `A${i + 1}`, impp })) },
  { name: "String B · mixed batch", modules: [11.34, 11.28, 10.71, 11.33, 11.3, 11.36, 11.29, 11.31].map((impp, i) => ({ name: `B${i + 1}`, impp })) },
  { name: "String C · one replacement", modules: [11.3, 11.32, 11.28, 11.31, 10.24, 11.35, 11.29, 11.33].map((impp, i) => ({ name: `C${i + 1}`, impp })) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>String mismatch</CardTitle>
        <CardDescription>A string runs at its worst module</CardDescription>
      </CardHeader>
      <CardContent>
        <StringMismatch strings={strings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One replacement panel of a different batch is not free <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Measured Impp
        </div>
      </CardFooter>
    </Card>
  )
}
