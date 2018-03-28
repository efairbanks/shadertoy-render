#!/bin/sh
ffmpeg -i $1 -crf 18 -pix_fmt yuv420p -c:a copy $2
